import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Users, Building2, CalendarDays, Plus, Search, Settings2, X,
  Check, XCircle, Mail, Phone,
  ChevronRight, Trash2, Edit3,
} from 'lucide-react';
import {
  useEmployeeList, useEmployeeCounts, useCreateEmployee, useUpdateEmployee, useDeleteEmployee,
  useDepartmentList, useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
  useTimeOffList, useCreateTimeOff, useUpdateTimeOff, useDeleteTimeOff,
  useSeedHrData,
  type HrEmployee, type HrDepartment, type HrTimeOff,
} from './hooks';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Modal } from '../../components/ui/modal';
import { IconButton } from '../../components/ui/icon-button';
import { Badge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { useUIStore } from '../../stores/ui-store';
import '../../styles/hr.css';

// ─── Navigation ────────────────────────────────────────────────────

type NavSection = 'employees' | 'departments' | 'time-off' | `dept:${string}`;

// ─── Status helpers ────────────────────────────────────────────────

function getStatusBadge(status: HrEmployee['status']) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Active</Badge>;
    case 'on-leave':
      return <Badge variant="warning">On leave</Badge>;
    case 'terminated':
      return <Badge variant="error">Terminated</Badge>;
  }
}

function getTimeOffTypeBadge(type: HrTimeOff['type']) {
  switch (type) {
    case 'vacation':
      return <Badge variant="primary">Vacation</Badge>;
    case 'sick':
      return <Badge variant="warning">Sick</Badge>;
    case 'personal':
      return <Badge variant="default">Personal</Badge>;
  }
}

function getTimeOffStatusBadge(status: HrTimeOff['status']) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">Pending</Badge>;
    case 'approved':
      return <Badge variant="success">Approved</Badge>;
    case 'rejected':
      return <Badge variant="error">Rejected</Badge>;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Color Presets ─────────────────────────────────────────────────

const DEPARTMENT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

// ─── Create Employee Modal ─────────────────────────────────────────

function CreateEmployeeModal({
  open,
  onClose,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  departments: HrDepartment[];
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const createEmployee = useCreateEmployee();

  const reset = () => {
    setName('');
    setEmail('');
    setRole('');
    setDepartmentId('');
    setStartDate('');
  };

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) return;
    createEmployee.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        phone: null,
        role: role.trim() || 'Employee',
        departmentId: departmentId || null,
        status: 'active',
        startDate: startDate || new Date().toISOString().slice(0, 10),
        avatarUrl: null,
        tags: [],
        notes: null,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title="Add employee">
      <Modal.Header title="Add employee" subtitle="Create a new employee record" />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" autoFocus />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
          <Input label="Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Software Engineer" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              Department
            </label>
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={[
                { value: '', label: 'None' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              placeholder="Select department..."
            />
          </div>
          <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim() || !email.trim()}>
          Add employee
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Create Department Modal ───────────────────────────────────────

function CreateDepartmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEPARTMENT_COLORS[0]);
  const createDepartment = useCreateDepartment();

  const reset = () => {
    setName('');
    setDescription('');
    setColor(DEPARTMENT_COLORS[0]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createDepartment.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        color,
        headEmployeeId: null,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title="Add department">
      <Modal.Header title="Add department" subtitle="Create a new department" />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label="Department name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" autoFocus />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPARTMENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-md)',
                    background: c,
                    border: color === c ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'border-color 0.1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
          Add department
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Request Time Off Modal ────────────────────────────────────────

function RequestTimeOffModal({
  open,
  onClose,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  employees: HrEmployee[];
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<'vacation' | 'sick' | 'personal'>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const createTimeOff = useCreateTimeOff();

  const reset = () => {
    setEmployeeId('');
    setType('vacation');
    setStartDate('');
    setEndDate('');
    setNotes('');
  };

  const handleSubmit = () => {
    if (!employeeId || !startDate || !endDate) return;
    createTimeOff.mutate(
      {
        employeeId,
        type,
        startDate,
        endDate,
        status: 'pending',
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title="Request time off">
      <Modal.Header title="Request time off" subtitle="Submit a time off request" />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              Employee
            </label>
            <Select
              value={employeeId}
              onChange={setEmployeeId}
              options={employees.filter((e) => e.status === 'active').map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Select employee..."
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              Type
            </label>
            <Select
              value={type}
              onChange={(v) => setType(v as typeof type)}
              options={[
                { value: 'vacation', label: 'Vacation' },
                { value: 'sick', label: 'Sick leave' },
                { value: 'personal', label: 'Personal' },
              ]}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!employeeId || !startDate || !endDate}>
          Submit request
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Edit Department Modal ─────────────────────────────────────────

function EditDepartmentModal({
  open,
  onClose,
  department,
}: {
  open: boolean;
  onClose: () => void;
  department: HrDepartment;
}) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || '');
  const [color, setColor] = useState(department.color);
  const updateDepartment = useUpdateDepartment();

  useEffect(() => {
    setName(department.name);
    setDescription(department.description || '');
    setColor(department.color);
  }, [department]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    updateDepartment.mutate(
      {
        id: department.id,
        name: name.trim(),
        description: description.trim() || null,
        color,
      },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title="Edit department">
      <Modal.Header title="Edit department" />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label="Department name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPARTMENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-md)',
                    background: c,
                    border: color === c ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'border-color 0.1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
          Save changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Employee Detail Panel ─────────────────────────────────────────

function EmployeeDetailPanel({
  employee,
  departments,
  timeOffRequests,
  onClose,
}: {
  employee: HrEmployee;
  departments: HrDepartment[];
  timeOffRequests: HrTimeOff[];
  onClose: () => void;
}) {
  const [status, setStatus] = useState(employee.status);
  const [departmentId, setDepartmentId] = useState(employee.departmentId || '');
  const [role, setRole] = useState(employee.role);
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const roleRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setStatus(employee.status);
    setDepartmentId(employee.departmentId || '');
    setRole(employee.role);
  }, [employee.id, employee.status, employee.departmentId, employee.role]);

  const autoSave = useCallback(
    (updates: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateEmployee.mutate({ id: employee.id, ...updates } as any);
      }, 500);
    },
    [employee.id, updateEmployee],
  );

  const handleDelete = () => {
    deleteEmployee.mutate(employee.id);
    onClose();
  };

  const department = departmentId ? departments.find((d) => d.id === departmentId) : null;
  const employeeTimeOff = timeOffRequests.filter((t) => t.employeeId === employee.id);

  return (
    <div className="hr-detail-panel" style={{ height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-family)',
        }}>
          Employee detail
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label="Delete employee" size={28} destructive onClick={handleDelete} />
          <IconButton icon={<X size={14} />} label="Close" size={28} onClick={onClose} />
        </div>
      </div>

      <SmartButtonBar appId="hr" recordId={employee.id} />

      {/* Body */}
      <div className="hr-detail-body">
        {/* Avatar + name header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Avatar name={employee.name} email={employee.email} size={48} />
          <div>
            <div style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}>
              {employee.name}
            </div>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
            }}>
              {employee.role}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {/* Email */}
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">Email</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              <Mail size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              {employee.email}
            </div>
          </div>

          {/* Phone */}
          {employee.phone && (
            <div className="hr-detail-field">
              <span className="hr-detail-field-label">Phone</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <Phone size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {employee.phone}
              </div>
            </div>
          )}

          {/* Role */}
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">Role</span>
            <input
              ref={roleRef}
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                autoSave({ role: e.target.value });
              }}
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '4px 0',
                borderBottom: '1px solid transparent',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--color-border-focus)'; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />
          </div>

          {/* Department */}
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">Department</span>
            <Select
              value={departmentId}
              onChange={(v) => {
                setDepartmentId(v);
                updateEmployee.mutate({ id: employee.id, departmentId: v || null });
              }}
              options={[
                { value: '', label: 'None' },
                ...departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                  icon: <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />,
                })),
              ]}
              size="sm"
            />
          </div>

          {/* Status */}
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">Status</span>
            <Select
              value={status}
              onChange={(v) => {
                const newStatus = v as HrEmployee['status'];
                setStatus(newStatus);
                updateEmployee.mutate({ id: employee.id, status: newStatus });
              }}
              options={[
                { value: 'active', label: 'Active', color: 'var(--color-success)' },
                { value: 'on-leave', label: 'On leave', color: 'var(--color-warning)' },
                { value: 'terminated', label: 'Terminated', color: 'var(--color-error)' },
              ]}
              size="sm"
            />
          </div>

          {/* Start date */}
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">Start date</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {formatDate(employee.startDate)}
            </div>
          </div>

          {/* Tags */}
          {employee.tags.length > 0 && (
            <div className="hr-detail-field">
              <span className="hr-detail-field-label">Tags</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {employee.tags.map((tag) => (
                  <Badge key={tag} variant="default">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Time off requests for this employee */}
        {employeeTimeOff.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 'var(--spacing-sm)',
              fontFamily: 'var(--font-family)',
            }}>
              Time off requests
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {employeeTimeOff.map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: '8px var(--spacing-sm)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {getTimeOffTypeBadge(req.type)}
                  <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>
                    {formatDate(req.startDate)} - {formatDate(req.endDate)}
                  </span>
                  {getTimeOffStatusBadge(req.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Employees List View ───────────────────────────────────────────

function EmployeesListView({
  employees,
  departments,
  selectedId,
  onSelect,
  searchQuery,
}: {
  employees: HrEmployee[];
  departments: HrDepartment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q),
    );
  }, [employees, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="hr-empty-state">
        <Users size={48} className="hr-empty-state-icon" />
        <div className="hr-empty-state-title">
          {searchQuery ? 'No matching employees' : 'No employees yet'}
        </div>
        <div className="hr-empty-state-desc">
          {searchQuery ? 'Try a different search term.' : 'Add your first employee to get started.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Table header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          padding: '8px var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-secondary)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-family)',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 220, flexShrink: 0 }}>Name</span>
        <span style={{ width: 180, flexShrink: 0 }}>Email</span>
        <span style={{ width: 140, flexShrink: 0 }}>Role</span>
        <span style={{ width: 120, flexShrink: 0 }}>Department</span>
        <span style={{ width: 80, flexShrink: 0 }}>Status</span>
        <span style={{ flex: 1 }}>Started</span>
      </div>

      {filtered.map((emp) => {
        const dept = emp.departmentId ? departments.find((d) => d.id === emp.departmentId) : null;
        return (
          <div
            key={emp.id}
            className={`hr-employee-row${selectedId === emp.id ? ' selected' : ''}`}
            onClick={() => onSelect(emp.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: 220, flexShrink: 0 }}>
              <Avatar name={emp.name} email={emp.email} size={28} />
              <span style={{
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {emp.name}
              </span>
            </div>
            <span style={{
              width: 180,
              flexShrink: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {emp.email}
            </span>
            <span style={{
              width: 140,
              flexShrink: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {emp.role}
            </span>
            <span style={{ width: 120, flexShrink: 0 }}>
              {dept ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-family)',
                  color: 'var(--color-text-secondary)',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />
                  {dept.name}
                </span>
              ) : (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>-</span>
              )}
            </span>
            <span style={{ width: 80, flexShrink: 0 }}>
              {getStatusBadge(emp.status)}
            </span>
            <span style={{
              flex: 1,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
            }}>
              {formatDate(emp.startDate)}
            </span>
            {selectedId === emp.id && (
              <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Departments View ──────────────────────────────────────────────

function DepartmentsView({
  departments,
  employees,
  onEdit,
  onDelete,
}: {
  departments: HrDepartment[];
  employees: HrEmployee[];
  onEdit: (dept: HrDepartment) => void;
  onDelete: (id: string) => void;
}) {
  if (departments.length === 0) {
    return (
      <div className="hr-empty-state">
        <Building2 size={48} className="hr-empty-state-icon" />
        <div className="hr-empty-state-title">No departments yet</div>
        <div className="hr-empty-state-desc">Create departments to organize your team.</div>
      </div>
    );
  }

  return (
    <div className="hr-dept-grid">
      {departments.map((dept) => {
        const deptEmployees = employees.filter((e) => e.departmentId === dept.id);
        const headEmployee = dept.headEmployeeId
          ? employees.find((e) => e.id === dept.headEmployeeId)
          : null;

        return (
          <div key={dept.id} className="hr-dept-card">
            {/* Color bar */}
            <div style={{ height: 4, background: dept.color }} />
            <div style={{ padding: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                <div>
                  <div style={{
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                    marginBottom: 4,
                  }}>
                    {dept.name}
                  </div>
                  {dept.description && (
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-tertiary)',
                      fontFamily: 'var(--font-family)',
                    }}>
                      {dept.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <IconButton icon={<Edit3 size={14} />} label="Edit department" size={28} onClick={() => onEdit(dept)} />
                  <IconButton icon={<Trash2 size={14} />} label="Delete department" size={28} destructive onClick={() => onDelete(dept.id)} />
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'var(--spacing-sm)',
                borderTop: '1px solid var(--color-border-secondary)',
              }}>
                {headEmployee ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                    <Avatar name={headEmployee.name} email={headEmployee.email} size={20} />
                    {headEmployee.name}
                  </div>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                    No head assigned
                  </span>
                )}
                <span style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {deptEmployees.length} {deptEmployees.length === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Time Off View ─────────────────────────────────────────────────

function TimeOffView({
  timeOffRequests,
  onApprove,
  onReject,
  onDelete,
}: {
  timeOffRequests: HrTimeOff[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (timeOffRequests.length === 0) {
    return (
      <div className="hr-empty-state">
        <CalendarDays size={48} className="hr-empty-state-icon" />
        <div className="hr-empty-state-title">No time off requests</div>
        <div className="hr-empty-state-desc">Time off requests will appear here.</div>
      </div>
    );
  }

  // Sort: pending first, then by start date
  const sorted = [...timeOffRequests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return a.startDate.localeCompare(b.startDate);
  });

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Table header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          padding: '8px var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-secondary)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-family)',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 160, flexShrink: 0 }}>Employee</span>
        <span style={{ width: 80, flexShrink: 0 }}>Type</span>
        <span style={{ width: 200, flexShrink: 0 }}>Dates</span>
        <span style={{ width: 80, flexShrink: 0 }}>Status</span>
        <span style={{ flex: 1 }}>Notes</span>
        <span style={{ width: 80, flexShrink: 0 }}>Actions</span>
      </div>

      {sorted.map((req) => (
        <div key={req.id} className="hr-time-off-row">
          <span style={{
            width: 160,
            flexShrink: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {req.employeeName}
          </span>
          <span style={{ width: 80, flexShrink: 0 }}>
            {getTimeOffTypeBadge(req.type)}
          </span>
          <span style={{
            width: 200,
            flexShrink: 0,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)',
          }}>
            {formatDate(req.startDate)} - {formatDate(req.endDate)}
          </span>
          <span style={{ width: 80, flexShrink: 0 }}>
            {getTimeOffStatusBadge(req.status)}
          </span>
          <span style={{
            flex: 1,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {req.notes || '-'}
          </span>
          <div style={{ width: 80, flexShrink: 0, display: 'flex', gap: 2 }}>
            {req.status === 'pending' ? (
              <>
                <IconButton
                  icon={<Check size={14} />}
                  label="Approve"
                  size={26}
                  onClick={() => onApprove(req.id)}
                  style={{ color: 'var(--color-success)' }}
                />
                <IconButton
                  icon={<XCircle size={14} />}
                  label="Reject"
                  size={26}
                  destructive
                  onClick={() => onReject(req.id)}
                />
              </>
            ) : (
              <IconButton
                icon={<Trash2 size={14} />}
                label="Delete"
                size={26}
                destructive
                onClick={() => onDelete(req.id)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main HR Page ──────────────────────────────────────────────────

export function HrPage() {
  const isDesktop = !!('atlasDesktop' in window);
  const { openSettings } = useUIStore();

  // Navigation state
  const [activeNav, setActiveNav] = useState<NavSection>('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal state
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [showCreateDepartment, setShowCreateDepartment] = useState(false);
  const [showCreateTimeOff, setShowCreateTimeOff] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<HrDepartment | null>(null);

  // Data
  const { data: countsData } = useEmployeeCounts();
  const counts = countsData ?? {
    totalEmployees: 0,
    activeEmployees: 0,
    onLeaveEmployees: 0,
    terminatedEmployees: 0,
    pendingTimeOff: 0,
    departments: 0,
  };

  // Determine employee filters based on nav
  const employeeFilters = useMemo(() => {
    if (activeNav === 'employees') return {};
    if (activeNav.startsWith('dept:')) return { departmentId: activeNav.replace('dept:', '') };
    return {};
  }, [activeNav]);

  const { data: employeesData, isLoading: loadingEmployees } = useEmployeeList(employeeFilters);
  const employees = employeesData?.employees ?? [];

  const { data: departmentsData } = useDepartmentList();
  const departments = departmentsData?.departments ?? [];

  const { data: timeOffData } = useTimeOffList();
  const timeOffRequests = timeOffData?.timeOffRequests ?? [];

  const updateTimeOff = useUpdateTimeOff();
  const deleteTimeOff = useDeleteTimeOff();
  const deleteDepartment = useDeleteDepartment();
  const seedHr = useSeedHrData();

  // Auto-seed on first visit
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (
      !loadingEmployees &&
      employees.length === 0 &&
      departments.length === 0 &&
      !hasSeeded.current &&
      countsData !== undefined &&
      counts.totalEmployees === 0
    ) {
      hasSeeded.current = true;
      seedHr.mutate();
    }
  }, [loadingEmployees, employees.length, departments.length, countsData, counts.totalEmployees, seedHr]);

  // Selected employee
  const selectedEmployee = selectedEmployeeId ? employees.find((e) => e.id === selectedEmployeeId) : null;

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else if (selectedEmployeeId) {
          setSelectedEmployeeId(null);
        }
      }
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmployeeId, showSearch]);

  // Section title
  const sectionTitle = useMemo(() => {
    if (activeNav === 'employees') return 'All employees';
    if (activeNav === 'departments') return 'Departments';
    if (activeNav === 'time-off') return 'Time off';
    if (activeNav.startsWith('dept:')) {
      const dept = departments.find((d) => d.id === activeNav.replace('dept:', ''));
      return dept?.name || 'Department';
    }
    return 'HR';
  }, [activeNav, departments]);

  // Add button handler
  const handleAdd = () => {
    if (activeNav === 'departments') setShowCreateDepartment(true);
    else if (activeNav === 'time-off') setShowCreateTimeOff(true);
    else setShowCreateEmployee(true);
  };

  const handleApproveTimeOff = (id: string) => {
    updateTimeOff.mutate({ id, status: 'approved' });
  };

  const handleRejectTimeOff = (id: string) => {
    updateTimeOff.mutate({ id, status: 'rejected' });
  };

  const handleDeleteTimeOff = (id: string) => {
    deleteTimeOff.mutate(id);
  };

  const handleDeleteDepartment = (id: string) => {
    deleteDepartment.mutate(id);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_hr_sidebar"
        title="HR"
        footer={
          <SidebarItem
            label="Settings"
            icon={<Settings2 size={14} />}
            onClick={() => openSettings('hr')}
          />
        }
      >
        <SidebarSection>
          <SidebarItem
            label="All employees"
            icon={<Users size={14} />}
            isActive={activeNav === 'employees'}
            count={counts.totalEmployees}
            onClick={() => {
              setActiveNav('employees');
              setSelectedEmployeeId(null);
            }}
          />
        </SidebarSection>

        <SidebarSection title="Departments">
          <SidebarItem
            label="All departments"
            icon={<Building2 size={14} />}
            isActive={activeNav === 'departments'}
            count={counts.departments}
            onClick={() => {
              setActiveNav('departments');
              setSelectedEmployeeId(null);
            }}
          />
          {departments.map((dept) => (
            <SidebarItem
              key={dept.id}
              label={dept.name}
              icon={
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: dept.color,
                    flexShrink: 0,
                  }}
                />
              }
              isActive={activeNav === `dept:${dept.id}`}
              count={employees.filter((e) => e.departmentId === dept.id).length}
              onClick={() => {
                setActiveNav(`dept:${dept.id}`);
                setSelectedEmployeeId(null);
              }}
            />
          ))}
        </SidebarSection>

        <SidebarSection>
          <SidebarItem
            label="Time off"
            icon={<CalendarDays size={14} />}
            isActive={activeNav === 'time-off'}
            count={counts.pendingTimeOff}
            onClick={() => {
              setActiveNav('time-off');
              setSelectedEmployeeId(null);
            }}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Content header */}
        <div className="hr-content-header">
          <span className="hr-content-header-title">{sectionTitle}</span>
          <div className="hr-content-header-actions">
            <IconButton
              icon={<Search size={14} />}
              label="Search"
              size={28}
              active={showSearch}
              onClick={() => {
                setShowSearch(!showSearch);
                if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={handleAdd}
            >
              {activeNav === 'departments' ? 'Add department' : activeNav === 'time-off' ? 'Request time off' : 'Add employee'}
            </Button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="hr-search-bar">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employees..."
              iconLeft={<Search size={14} />}
              size="sm"
              style={{ border: 'none', background: 'transparent' }}
            />
            <IconButton
              icon={<X size={14} />}
              label="Close search"
              size={24}
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
            />
          </div>
        )}

        {/* Content area */}
        {(activeNav === 'employees' || activeNav.startsWith('dept:')) && (
          <EmployeesListView
            employees={employees}
            departments={departments}
            selectedId={selectedEmployeeId}
            onSelect={setSelectedEmployeeId}
            searchQuery={searchQuery}
          />
        )}

        {activeNav === 'departments' && (
          <DepartmentsView
            departments={departments}
            employees={employees}
            onEdit={setEditingDepartment}
            onDelete={handleDeleteDepartment}
          />
        )}

        {activeNav === 'time-off' && (
          <TimeOffView
            timeOffRequests={timeOffRequests}
            onApprove={handleApproveTimeOff}
            onReject={handleRejectTimeOff}
            onDelete={handleDeleteTimeOff}
          />
        )}
      </div>

      {/* Detail panel */}
      {selectedEmployee && (activeNav === 'employees' || activeNav.startsWith('dept:')) && (
        <div
          style={{
            width: 360,
            borderLeft: '1px solid var(--color-border-primary)',
            flexShrink: 0,
            overflow: 'hidden',
            height: '100%',
          }}
        >
          <EmployeeDetailPanel
            employee={selectedEmployee}
            departments={departments}
            timeOffRequests={timeOffRequests}
            onClose={() => setSelectedEmployeeId(null)}
          />
        </div>
      )}

      {/* Modals */}
      <CreateEmployeeModal
        open={showCreateEmployee}
        onClose={() => setShowCreateEmployee(false)}
        departments={departments}
      />
      <CreateDepartmentModal
        open={showCreateDepartment}
        onClose={() => setShowCreateDepartment(false)}
      />
      <RequestTimeOffModal
        open={showCreateTimeOff}
        onClose={() => setShowCreateTimeOff(false)}
        employees={employees}
      />
      {editingDepartment && (
        <EditDepartmentModal
          open={!!editingDepartment}
          onClose={() => setEditingDepartment(null)}
          department={editingDepartment}
        />
      )}
    </div>
  );
}
