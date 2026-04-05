import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useLeaveCalendar } from '../../hooks';
import { IconButton } from '../../../../components/ui/icon-button';
import { formatDate } from '../../../../lib/format';

export function TeamCalendarView() {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data: calendarData } = useLeaveCalendar(currentMonth);

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setCurrentMonth(d.toISOString().slice(0, 7));
  };

  // Group by employee
  const byEmployee = useMemo(() => {
    const map: Record<string, { name: string; leaves: typeof calendarData }> = {};
    for (const entry of calendarData || []) {
      if (!map[entry.employeeId]) map[entry.employeeId] = { name: entry.employeeName, leaves: [] };
      map[entry.employeeId].leaves!.push(entry);
    }
    return Object.entries(map);
  }, [calendarData]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
        <IconButton icon={<ChevronLeft size={14} />} label={t('common.previous')} size={28} onClick={prevMonth} />
        <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', minWidth: 180, textAlign: 'center' }}>
          {monthName}
        </span>
        <IconButton icon={<ChevronRight size={14} />} label={t('common.next')} size={28} onClick={nextMonth} />
      </div>

      {byEmployee.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)' }}>
          <Calendar size={40} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
          <p style={{ fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-md)' }}>{t('hr.teamCalendar.noLeaves')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {byEmployee.map(([empId, { name, leaves }]) => (
            <div key={empId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-sm) 0' }}>
              <span style={{ width: 140, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>{name}</span>
              <div style={{ flex: 1, display: 'flex', gap: 2, position: 'relative', height: 24 }}>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                  const leave = leaves?.find(l => l.startDate <= dateStr && l.endDate >= dateStr);
                  return (
                    <div key={day} style={{
                      flex: 1, height: 24, borderRadius: 'var(--radius-sm)',
                      background: leave ? leave.leaveTypeColor : 'var(--color-bg-secondary)',
                      opacity: leave ? 0.7 : 0.3, minWidth: 4,
                    }} title={leave ? `${leave.leaveTypeName} (${formatDate(leave.startDate)} - ${formatDate(leave.endDate)})` : dateStr} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
