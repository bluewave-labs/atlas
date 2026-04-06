import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Download } from 'lucide-react';
import { useHolidayCalendars, useCreateHolidayCalendar, useHolidays, useCreateHoliday, useDeleteHoliday } from '../../hooks';
import { useMyAppPermission } from '../../../../hooks/use-app-permissions';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { IconButton } from '../../../../components/ui/icon-button';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { Popover, PopoverTrigger, PopoverContent } from '../../../../components/ui/popover';
import { useToastStore } from '../../../../stores/toast-store';
import { formatDate } from '../../../../lib/format';
import { COUNTRY_HOLIDAY_PACKS } from '../../lib/country-holidays';

export function HolidaysView() {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
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
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const importingRef = useRef(false);

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

  const handleImportCountry = async (countryCode: string) => {
    if (!selectedCalendarId || importingRef.current) return;
    importingRef.current = true;
    setImporting(countryCode);
    const pack = COUNTRY_HOLIDAY_PACKS.find((p) => p.countryCode === countryCode);
    if (!pack) return;

    let imported = 0;
    for (const holiday of pack.holidays) {
      try {
        await new Promise<void>((resolve, reject) => {
          createHoliday.mutate(
            { calendarId: selectedCalendarId, name: holiday.name, date: holiday.date, type: holiday.type },
            { onSuccess: () => { imported++; resolve(); }, onError: reject },
          );
        });
      } catch {
        // skip failed ones
      }
    }

    addToast({
      type: 'success',
      message: t('hr.holidays.importSuccess', { count: imported, country: pack.countryName }),
    });
    setImporting(null);
    setImportOpen(false);
    importingRef.current = false;
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

        {selectedCalendarId && (
          <Popover open={importOpen} onOpenChange={setImportOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" icon={<Download size={14} />}>
                {t('hr.holidays.importHolidays')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" style={{ width: 300, padding: 0 }}>
              <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '1px solid var(--color-border-secondary)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                  {t('hr.holidays.importTitle')}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: 2 }}>
                  {t('hr.holidays.importDesc')}
                </div>
              </div>
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                {COUNTRY_HOLIDAY_PACKS.map((pack) => (
                  <button
                    key={pack.countryCode}
                    onClick={() => handleImportCountry(pack.countryCode)}
                    disabled={importing !== null}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-md)',
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-lg)',
                      border: 'none',
                      background: importing === pack.countryCode ? 'var(--color-surface-selected)' : 'transparent',
                      cursor: importing !== null ? 'wait' : 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-family)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!importing) e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { if (importing !== pack.countryCode) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{pack.flag}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                        {pack.countryName}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {pack.holidays.length} {t('hr.holidays.holidayCount')}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
