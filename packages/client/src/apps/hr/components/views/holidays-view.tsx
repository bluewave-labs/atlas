import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { useHolidayCalendars, useCreateHolidayCalendar, useHolidays, useCreateHoliday, useDeleteHoliday } from '../../hooks';
import { useMyAppPermission } from '../../../../hooks/use-app-permissions';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { IconButton } from '../../../../components/ui/icon-button';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { formatDate } from '../../../../lib/format';

export function HolidaysView() {
  const { t } = useTranslation();
  const { data: hrPerm } = useMyAppPermission('hr');
  const canDelete = !hrPerm || hrPerm.role === 'admin';
  const { data: calendars } = useHolidayCalendars();
  const createCalendar = useCreateHolidayCalendar();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const { data: holidays } = useHolidays(selectedCalendarId ?? undefined);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [hName, setHName] = useState('');
  const [hDate, setHDate] = useState('');
  const [hType, setHType] = useState('public');

  // Auto-select first calendar
  useEffect(() => {
    if (calendars?.length && !selectedCalendarId) setSelectedCalendarId(calendars[0].id);
  }, [calendars, selectedCalendarId]);

  const handleCreateCalendar = () => {
    const year = new Date().getFullYear();
    createCalendar.mutate({ name: `${t('hr.holidays.calendar')} ${year}`, year, isDefault: true });
  };

  const handleAddHoliday = () => {
    if (!hName.trim() || !hDate || !selectedCalendarId) return;
    createHoliday.mutate({ calendarId: selectedCalendarId, name: hName.trim(), date: hDate, type: hType }, {
      onSuccess: () => { setShowAddHoliday(false); setHName(''); setHDate(''); },
    });
  };

  const typeColors: Record<string, string> = { public: 'var(--color-error)', company: 'var(--color-accent-primary)', optional: 'var(--color-warning)' };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {/* Calendar selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
        {calendars && calendars.length > 0 ? (
          <Select
            value={selectedCalendarId || ''}
            onChange={(v) => setSelectedCalendarId(v)}
            options={calendars.map(c => ({ value: c.id, label: `${c.name} (${c.year})` }))}
            size="sm"
          />
        ) : (
          <Button variant="secondary" size="sm" onClick={handleCreateCalendar}>{t('hr.holidays.createCalendar')}</Button>
        )}
      </div>

      {/* Holiday list */}
      {selectedCalendarId && (
        <>
          {(!holidays || holidays.length === 0) && !showAddHoliday && (
            <FeatureEmptyState
              illustration="calendar"
              title={t('hr.holidays.empty')}
              description={t('hr.holidays.emptyDesc')}
              actionLabel={t('hr.holidays.add')}
              actionIcon={<Plus size={14} />}
              onAction={() => setShowAddHoliday(true)}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {holidays?.map((h) => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-lg)',
                borderBottom: '1px solid var(--color-border-secondary)',
              }}>
                <div style={{ width: 4, height: 24, borderRadius: 2, background: typeColors[h.type] || 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span style={{ width: 100, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                  {formatDate(h.date)}
                </span>
                <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                  {h.name}
                </span>
                <Badge variant={h.type === 'public' ? 'error' : h.type === 'company' ? 'primary' : 'warning'}>{t(`hr.holidays.type${h.type.charAt(0).toUpperCase() + h.type.slice(1)}`)}</Badge>
                {canDelete && <IconButton icon={<Trash2 size={14} />} label={t('common.delete')} size={26} destructive onClick={() => deleteHoliday.mutate(h.id)} />}
              </div>
            ))}
          </div>

          {showAddHoliday && (
            <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <Input label={t('hr.holidays.name')} value={hName} onChange={(e) => setHName(e.target.value)} placeholder={t('hr.placeholder.holidayName')} style={{ flex: 1 }} autoFocus />
                <Input label={t('hr.holidays.date')} type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} style={{ flex: 1 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1 }}>
                  <label className="hr-field-label">{t('hr.fields.type')}</label>
                  <Select value={hType} onChange={setHType} options={[
                    { value: 'public', label: t('hr.holidays.typePublic') },
                    { value: 'company', label: t('hr.holidays.typeCompany') },
                    { value: 'optional', label: t('hr.holidays.typeOptional') },
                  ]} size="sm" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowAddHoliday(false)}>{t('common.cancel')}</Button>
                <Button variant="primary" size="sm" onClick={handleAddHoliday} disabled={!hName.trim() || !hDate}>{t('common.save')}</Button>
              </div>
            </div>
          )}

          {!showAddHoliday && (
            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddHoliday(true)}>
                {t('hr.holidays.add')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
