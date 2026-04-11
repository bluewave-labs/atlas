import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2, CalendarDays, Plus, Mail, Trash2, User, Briefcase, Tag } from 'lucide-react';
import { useDeleteEmployee, type HrEmployee, type HrDepartment } from '../../hooks';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { useHrSettingsStore } from '../../settings-store';
import { Avatar } from '../../../../components/ui/avatar';
import { StatusDot } from '../../../../components/ui/status-dot';
import { DataTable, type DataTableColumn } from '../../../../components/ui/data-table';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { getStatusBadge } from '../../lib/hr-utils';
import { formatDate } from '../../../../lib/format';

export function EmployeesListView({
  employees,
  departments,
  selectedId,
  onSelect,
  searchQuery,
  onAdd,
}: {
  employees: HrEmployee[];
  departments: HrDepartment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { canCreate, canDelete: isAdmin } = useAppActions('hr');
  const showDept = useHrSettingsStore((s) => s.showDepartmentInList);
  const deleteEmployee = useDeleteEmployee();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await deleteEmployee.mutateAsync(id);
    }
    setSelected(new Set());
    setShowDeleteConfirm(false);
  };

  const empColumns: DataTableColumn<HrEmployee>[] = useMemo(() => {
    const cols: DataTableColumn<HrEmployee>[] = [
      {
        key: 'name', label: t('hr.columns.name'), icon: <User size={12} />, width: 200, sortable: true,
        render: (emp) => (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <Avatar name={emp.name} size={28} />
            <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
          </span>
        ),
        searchValue: (emp) => emp.name,
      },
      {
        key: 'email', label: t('hr.columns.email'), icon: <Mail size={12} />, width: 180, sortable: true,
        render: (emp) => <span className="dt-cell-secondary">{emp.email}</span>,
        searchValue: (emp) => emp.email,
      },
      {
        key: 'role', label: t('hr.columns.role'), icon: <Briefcase size={12} />, width: 140, sortable: true,
        render: (emp) => <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{emp.role}</span>,
        searchValue: (emp) => emp.role,
      },
    ];
    if (showDept) {
      cols.push({
        key: 'department', label: t('hr.columns.department'), icon: <Building2 size={12} />, width: 120,
        render: (emp) => {
          const dept = emp.departmentId ? departments.find((d) => d.id === emp.departmentId) : null;
          return dept ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <StatusDot color={dept.color} size={8} />{dept.name}
            </span>
          ) : <span className="dt-cell-secondary">-</span>;
        },
        searchValue: (emp) => {
          const dept = emp.departmentId ? departments.find((d) => d.id === emp.departmentId) : null;
          return dept ? dept.name : '';
        },
      });
    }
    cols.push(
      {
        key: 'status', label: t('hr.columns.status'), icon: <Tag size={12} />, width: 80,
        render: (emp) => getStatusBadge(emp.status, t),
        searchValue: (emp) => emp.status,
      },
      {
        key: 'startDate', label: t('hr.columns.started'), icon: <CalendarDays size={12} />, width: 100, sortable: true,
        render: (emp) => <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{formatDate(emp.startDate)}</span>,
        searchValue: (emp) => formatDate(emp.startDate),
      },
    );
    return cols;
  }, [t, showDept, departments]);

  if (filtered.length === 0) {
    if (searchQuery) {
      return (
        <div className="hr-empty-state">
          <Users size={48} className="hr-empty-state-icon" />
          <div className="hr-empty-state-title">{t('hr.employees.noMatch')}</div>
          <div className="hr-empty-state-desc">{t('hr.employees.noMatchDesc')}</div>
        </div>
      );
    }
    return (
      <FeatureEmptyState
        illustration="employees"
        title={t('hr.empty.title')}
        description={t('hr.empty.desc')}
        highlights={[
          { icon: <Users size={14} />, title: t('hr.empty.h1Title'), description: t('hr.empty.h1Desc') },
          { icon: <Building2 size={14} />, title: t('hr.empty.h2Title'), description: t('hr.empty.h2Desc') },
          { icon: <CalendarDays size={14} />, title: t('hr.empty.h3Title'), description: t('hr.empty.h3Desc') },
        ]}
        actionLabel={canCreate ? t('hr.actions.addEmployee') : undefined}
        actionIcon={canCreate ? <Plus size={14} /> : undefined}
        onAction={canCreate ? onAdd : undefined}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <DataTable
        data={filtered}
        columns={empColumns}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        activeRowId={selectedId}
        onRowClick={(emp) => onSelect(emp.id)}
        paginated={false}
        searchable
        exportable
        columnSelector
        resizableColumns
        storageKey="hr-employees"
        bulkActions={isAdmin ? [
          {
            key: 'delete',
            label: t('hr.actions.deleteEmployee'),
            icon: <Trash2 size={13} />,
            variant: 'danger',
            onAction: () => setShowDeleteConfirm(true),
          },
        ] : []}
        emptyTitle={t('hr.employees.noEmployees')}
      />

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('hr.actions.deleteEmployee')}
        description={t('hr.employees.bulkDeleteDesc', { count: selected.size })}
        confirmLabel={t('hr.actions.deleteEmployee')}
        onConfirm={handleBulkDelete}
        destructive
      />
    </div>
  );
}
