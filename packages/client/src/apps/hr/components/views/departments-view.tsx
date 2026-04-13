import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Trash2, Edit3, Users, BarChart3 } from 'lucide-react';
import { type HrDepartment, type HrEmployee } from '../../hooks';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { IconButton } from '../../../../components/ui/icon-button';
import { Avatar } from '../../../../components/ui/avatar';
import { Card } from '../../../../components/ui/card';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';

export function DepartmentsView({
  departments,
  employees,
  onEdit,
  onDelete,
  onSelectDepartment,
}: {
  departments: HrDepartment[];
  employees: HrEmployee[];
  onEdit: (dept: HrDepartment) => void;
  onDelete: (id: string) => void;
  onSelectDepartment?: (deptId: string) => void;
}) {
  const { t } = useTranslation();
  const { canDelete, canEdit } = useAppActions('hr');

  const employeesByDepartment = useMemo(() => {
    const map = new Map<string, HrEmployee[]>();
    for (const e of employees) {
      if (e.departmentId) {
        const list = map.get(e.departmentId);
        if (list) list.push(e);
        else map.set(e.departmentId, [e]);
      }
    }
    return map;
  }, [employees]);

  const employeeById = useMemo(() => {
    const map = new Map<string, HrEmployee>();
    for (const e of employees) map.set(e.id, e);
    return map;
  }, [employees]);

  if (departments.length === 0) {
    return (
      <FeatureEmptyState
        illustration="employees"
        title={t('hr.departments.noDepartments', 'No departments')}
        description={t('hr.departments.noDepartmentsDesc', 'Create your first department to organize your team.')}
        highlights={[
          { icon: <Building2 size={14} />, title: t('hr.departments.organize', 'Organize teams'), description: t('hr.departments.organizeDesc', 'Group employees by department') },
          { icon: <Users size={14} />, title: t('hr.departments.managers', 'Assign managers'), description: t('hr.departments.managersDesc', 'Set department leads and reporting lines') },
          { icon: <BarChart3 size={14} />, title: t('hr.departments.insights', 'Track headcount'), description: t('hr.departments.insightsDesc', 'See department size and growth') },
        ]}
      />
    );
  }

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: 'var(--spacing-xl)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--spacing-lg)',
      }}>
        {departments.map((dept) => {
          const deptEmployees = employeesByDepartment.get(dept.id) ?? [];
          const headEmployee = dept.headEmployeeId ? employeeById.get(dept.headEmployeeId) ?? null : null;

          return (
            <Card
              key={dept.id}
              accentColor={dept.color}
              onClick={onSelectDepartment ? () => onSelectDepartment(dept.id) : undefined}
            >
              {/* Header: name + actions */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 'var(--spacing-md)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                    marginBottom: 'var(--spacing-xs)',
                  }}>
                    {dept.name}
                  </div>
                  {dept.description && (
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-tertiary)',
                      fontFamily: 'var(--font-family)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {dept.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 'var(--spacing-sm)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {canEdit && <IconButton icon={<Edit3 size={14} />} label={t('hr.actions.editDepartment')} size={28} onClick={() => onEdit(dept)} />}
                  {canDelete && <IconButton icon={<Trash2 size={14} />} label={t('hr.actions.deleteDepartment')} size={28} destructive onClick={() => onDelete(dept.id)} />}
                </div>
              </div>

              {/* Footer: head + count */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'var(--spacing-sm)',
                borderTop: '1px solid var(--color-border-secondary)',
              }}>
                {headEmployee ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-family)',
                    minWidth: 0,
                  }}>
                    <Avatar name={headEmployee.name} size={20} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {headEmployee.name}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                    {t('hr.departments.noHead')}
                  </span>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}>
                  <Users size={13} />
                  {deptEmployees.length} {deptEmployees.length === 1 ? t('hr.departments.member') : t('hr.departments.members')}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
