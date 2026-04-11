import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAttendanceList, useMarkAttendance, useBulkMarkAttendance, useAttendanceToday,
  type HrEmployee, type HrAttendanceRecord,
} from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { Avatar } from '../../../../components/ui/avatar';
import { StatusDot } from '../../../../components/ui/status-dot';

export function AttendanceView({ employees }: { employees: HrEmployee[] }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const { data: records, isLoading } = useAttendanceList({ date: selectedDate });
  const { data: todaySummary } = useAttendanceToday();
  const markAttendance = useMarkAttendance();
  const bulkMark = useBulkMarkAttendance();
  const { canEdit } = useAppActions('hr');

  const activeEmployees = employees.filter(e => e.status === 'active');

  // Map records by employeeId
  const recordMap = useMemo(() => {
    const map: Record<string, HrAttendanceRecord> = {};
    for (const r of records || []) map[r.employeeId] = r;
    return map;
  }, [records]);

  const handleMarkAll = () => {
    const unmarked = activeEmployees.filter(e => !recordMap[e.id]).map(e => e.id);
    if (unmarked.length === 0) return;
    bulkMark.mutate({ employeeIds: unmarked, date: selectedDate, status: 'present' });
  };

  const statusOptions = [
    { value: 'present', label: t('hr.attendance.present') },
    { value: 'absent', label: t('hr.attendance.absent') },
    { value: 'half-day', label: t('hr.attendance.halfDay') },
    { value: 'remote', label: t('hr.attendance.remote') },
    { value: 'on-leave', label: t('hr.attendance.onLeave') },
  ];

  const statusColors: Record<string, string> = {
    present: 'var(--color-success)', absent: 'var(--color-error)',
    'half-day': 'var(--color-warning)', remote: 'var(--color-accent-primary)', 'on-leave': 'var(--color-warning)',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {/* Summary cards */}
      {selectedDate === today && todaySummary && (
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
          {['present', 'absent', 'remote', 'on-leave'].map(s => (
            <div key={s} style={{ flex: 1, padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: statusColors[s] || 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {todaySummary[s] || 0}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', textTransform: 'capitalize' }}>
                {t(`hr.attendance.${s === 'half-day' ? 'halfDay' : s === 'on-leave' ? 'onLeave' : s}`)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Date picker + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} size="sm" style={{ width: 180 }} />
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={handleMarkAll}>{t('hr.attendance.markAllPresent')}</Button>
        )}
      </div>

      {/* Employee list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {activeEmployees.map((emp) => {
          const record = recordMap[emp.id];
          return (
            <div key={emp.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-sm) var(--spacing-lg)',
              borderBottom: '1px solid var(--color-border-secondary)',
            }}>
              <Avatar name={emp.name} src={emp.avatarUrl} size={28} />
              <span style={{ width: 180, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {emp.name}
              </span>
              <span style={{ width: 120, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {emp.departmentName || '-'}
              </span>
              <div style={{ width: 140 }}>
                <Select
                  value={record?.status || ''}
                  onChange={(v) => markAttendance.mutate({ employeeId: emp.id, date: selectedDate, status: v })}
                  options={[{ value: '', label: '-' }, ...statusOptions]}
                  size="sm"
                  disabled={!canEdit}
                />
              </div>
              {record && (
                <StatusDot color={statusColors[record.status] || 'var(--color-text-tertiary)'} size={10} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
