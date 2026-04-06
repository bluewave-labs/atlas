import { useTranslation } from 'react-i18next';
import { Building2, Trash2, Edit3, Users } from 'lucide-react';
import { type HrDepartment, type HrEmployee } from '../../hooks';
import { useMyAppPermission } from '../../../../hooks/use-app-permissions';
import { IconButton } from '../../../../components/ui/icon-button';
import { Avatar } from '../../../../components/ui/avatar';

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
  const { data: hrPerm } = useMyAppPermission('hr');
  const canDelete = !hrPerm || hrPerm.role === 'admin';
  if (departments.length === 0) {
    return (
      <div className="hr-empty-state">
        <Building2 size={48} className="hr-empty-state-icon" />
        <div className="hr-empty-state-title">{t('hr.departments.empty')}</div>
        <div className="hr-empty-state-desc">{t('hr.departments.emptyDesc')}</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 'var(--spacing-lg)',
    }}>
      {departments.map((dept) => {
        const deptEmployees = employees.filter((e) => e.departmentId === dept.id);
        const headEmployee = dept.headEmployeeId ? employees.find((e) => e.id === dept.headEmployeeId) : null;

        return (
          <div
            key={dept.id}
            onClick={() => onSelectDepartment?.(dept.id)}
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              cursor: onSelectDepartment ? 'pointer' : 'default',
              transition: 'box-shadow 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              e.currentTarget.style.background = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'var(--color-bg-primary)';
            }}
          >
            {/* Color stripe */}
            <div style={{ height: 4, background: dept.color }} />

            <div style={{ padding: 'var(--spacing-lg)' }}>
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
                  <IconButton icon={<Edit3 size={14} />} label={t('hr.actions.editDepartment')} size={28} onClick={() => onEdit(dept)} />
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
